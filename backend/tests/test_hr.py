from datetime import date, timedelta

def _admin_get_user_id(admin, username):
    users = admin.get("/api/users", params={"q": username}).json()
    for u in users:
        if u["username"] == username:
            return u["id"]
    raise AssertionError(f"user {username} not found")

def test_hr_assign_conflict_and_delete(admin, receptionist):
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    nurse_id = _admin_get_user_id(admin, "nurse.priya")

    existing = admin.get("/api/hr/shifts", params={"date": today}).json()
    for s in existing:
        if s["user_id"] == nurse_id:
            admin.delete(f"/api/hr/shifts/{s['id']}")

    ok = admin.post("/api/hr/shifts", json={"user_id": nurse_id, "work_date": tomorrow, "shift": "MORNING", "note": "ED cover"})
    assert ok.status_code == 201, ok.text
    sid = ok.json()["id"]

    dup = admin.post("/api/hr/shifts", json={"user_id": nurse_id, "work_date": tomorrow, "shift": "EVENING"})
    assert dup.status_code == 409

    listing = admin.get("/api/hr/shifts", params={"date": tomorrow}).json()
    assert any(s["id"] == sid for s in listing)

    cov = admin.get("/api/hr/coverage", params={"date": tomorrow}).json()
    assert cov["date"] == tomorrow
    assert cov["counts"]["MORNING"] >= 1

    removed = admin.delete(f"/api/hr/shifts/{sid}")
    assert removed.status_code == 200

    again = admin.post("/api/hr/shifts", json={"user_id": nurse_id, "work_date": tomorrow, "shift": "EVENING"})
    assert again.status_code == 201
    admin.delete(f"/api/hr/shifts/{again.json()['id']}")

def test_hr_rbac_and_invalid_user(admin, nurse, receptionist):
    today = date.today().isoformat()
    denied_receptionist = receptionist.post("/api/hr/shifts", json={"user_id": 1, "work_date": today, "shift": "MORNING"})
    assert denied_receptionist.status_code == 403

    denied_nurse = nurse.post("/api/hr/shifts", json={"user_id": 1, "work_date": today, "shift": "MORNING"})
    assert denied_nurse.status_code == 403

    bad_user = admin.post("/api/hr/shifts", json={"user_id": 999999, "work_date": today, "shift": "MORNING"})
    assert bad_user.status_code == 404

    read_ok = nurse.get("/api/hr/shifts", params={"date": today})
    assert read_ok.status_code == 200

def test_hr_range_and_off_shift(admin):
    today = date.today()
    start = today.isoformat()
    end = (today + timedelta(days=2)).isoformat()
    doctor_id = _admin_get_user_id(admin, "dr.house")
    lab_id = _admin_get_user_id(admin, "lab.vikram")

    for d in [today + timedelta(days=1), today + timedelta(days=2)]:
        for uid in [doctor_id, lab_id]:
            existing = admin.get("/api/hr/shifts", params={"date": d.isoformat(), "user_id": uid}).json() if False else []
            try:
                admin.delete(f"/api/hr/shifts/{existing[0]['id']}") if existing else None
            except Exception:
                pass

    r1 = admin.post("/api/hr/shifts", json={"user_id": doctor_id, "work_date": (today + timedelta(days=1)).isoformat(), "shift": "OFF", "note": "Weekly off"})
    r2 = admin.post("/api/hr/shifts", json={"user_id": lab_id, "work_date": (today + timedelta(days=2)).isoformat(), "shift": "NIGHT"})
    assert r1.status_code == 201
    assert r2.status_code == 201

    rng = admin.get("/api/hr/shifts", params={"from": start, "to": end}).json()
    assert len(rng) >= 2

    admin.delete(f"/api/hr/shifts/{r1.json()['id']}")
    admin.delete(f"/api/hr/shifts/{r2.json()['id']}")

from datetime import datetime, timedelta, timezone

UTC = timezone.utc

def _patient(receptionist, first, last, phone):
    return receptionist.post(
        "/api/patients?force=true", json={"first_name": first, "last_name": last, "phone": phone}
    ).json()

def _surgeon_id(admin):
    docs = admin.get("/api/doctors").json()
    assert docs, "no doctors seeded"
    return docs[0]["id"]

def _room(admin, code="OT-99"):
    r = admin.post("/api/ot/rooms", json={"code": code, "name": f"Theatre {code}", "floor": "3"})
    return r

def _booking_payload(room_id, patient_id, surgeon_id, start):
    end = start + timedelta(hours=2)
    return {
        "room_id": room_id,
        "patient_id": patient_id,
        "surgeon_profile_id": surgeon_id,
        "procedure_name": "Laparoscopic Cholecystectomy",
        "procedure_code": "47562",
        "anesthesia_type": "GA",
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
    }

def test_ot_room_crud_guardrails(admin, receptionist):
    denied = receptionist.post("/api/ot/rooms", json={"code": "OT-X1", "name": "Nope"})
    assert denied.status_code == 403
    ok = _room(admin, "OT-T1")
    assert ok.status_code == 201
    dup = _room(admin, "OT-T1")
    assert dup.status_code == 409
    listing = admin.get("/api/ot/rooms").json()
    assert any(r["code"] == "OT-T1" for r in listing)

def test_full_ot_lifecycle_with_who_checklist(doctor, nurse, receptionist, admin):
    patient = _patient(receptionist, "Ot", "Lifecycle", "+91-9150000001")
    surgeon_id = _surgeon_id(admin)
    room = admin.get("/api/ot/rooms").json()[0]
    start = datetime.now(UTC) + timedelta(days=1, hours=9)
    payload = _booking_payload(room["id"], patient["id"], surgeon_id, start)
    res = doctor.post("/api/ot/bookings", json=payload)
    assert res.status_code == 201, res.text
    bid = res.json()["id"]
    assert res.json()["status"] == "PLANNED"
    assert res.json()["sign_in_done"] is False

    start_denied = nurse.post(f"/api/ot/bookings/{bid}/start")
    assert start_denied.status_code == 400

    clr = doctor.post(f"/api/ot/bookings/{bid}/clearance")
    assert clr.status_code == 200
    assert clr.json()["cleared"] is True

    bad_order = nurse.post(f"/api/ot/bookings/{bid}/checklist", json={"phase": "TIME_OUT"})
    assert bad_order.status_code == 400

    assert nurse.post(f"/api/ot/bookings/{bid}/checklist", json={"phase": "SIGN_IN"}).status_code == 200
    assert nurse.post(f"/api/ot/bookings/{bid}/checklist", json={"phase": "TIME_OUT"}).status_code == 200

    started = nurse.post(f"/api/ot/bookings/{bid}/start")
    assert started.status_code == 200
    assert started.json()["status"] == "IN_PROGRESS"

    comp_blocked = doctor.post(f"/api/ot/bookings/{bid}/complete")
    assert comp_blocked.status_code == 400

    assert nurse.post(f"/api/ot/bookings/{bid}/checklist", json={"phase": "SIGN_OUT"}).status_code == 200

    done = doctor.post(f"/api/ot/bookings/{bid}/complete", json={"implants_note": "Mesh 15x15 lot M-42"})
    assert done.status_code == 200
    assert done.json()["status"] == "COMPLETED"
    assert done.json()["implants_note"] == "Mesh 15x15 lot M-42"

    rooms = admin.get("/api/ot/rooms").json()
    assert next(r for r in rooms if r["id"] == room["id"])["status"] == "AVAILABLE"

def test_ot_double_booking_conflicts(doctor, receptionist, admin):
    p1 = _patient(receptionist, "Ot", "ClashA", "+91-9150000002")
    p2 = _patient(receptionist, "Ot", "ClashB", "+91-9150000003")
    surgeon_id = _surgeon_id(admin)
    rooms = admin.get("/api/ot/rooms").json()
    r1, r2 = rooms[0], rooms[1] if len(rooms) > 1 else (rooms[0], rooms[0])
    base = datetime.now(UTC) + timedelta(days=2, hours=10)
    b1 = doctor.post("/api/ot/bookings", json=_booking_payload(r1["id"], p1["id"], surgeon_id, base))
    assert b1.status_code == 201

    overlap_same_room = doctor.post(
        "/api/ot/bookings",
        json=_booking_payload(r1["id"], p2["id"], surgeon_id, base + timedelta(minutes=30)),
    )
    assert overlap_same_room.status_code == 409

    overlap_same_surgeon_diff_room = doctor.post(
        "/api/ot/bookings",
        json=_booking_payload(r2["id"], p2["id"], surgeon_id, base + timedelta(minutes=30)),
    )
    assert overlap_same_surgeon_diff_room.status_code == 409

    non_overlap = doctor.post(
        "/api/ot/bookings",
        json=_booking_payload(r1["id"], p2["id"], surgeon_id, base + timedelta(hours=3)),
    )
    assert non_overlap.status_code == 201

def test_ot_maintenance_and_rbac(receptionist, doctor, admin):
    r = _room(admin, "OT-MAINT")
    assert r.status_code == 201
    rid = r.json()["id"]
    from app.db.session import SessionLocal
    from app.models import OtRoom
    db = SessionLocal()
    try:
        room = db.get(OtRoom, rid)
        room.status = "MAINTENANCE"
        db.commit()
    finally:
        db.close()

    patient = _patient(receptionist, "Ot", "Maint", "+91-9150000004")
    surgeon_id = _surgeon_id(admin)
    start = datetime.now(UTC) + timedelta(days=3, hours=8)
    denied = doctor.post("/api/ot/bookings", json=_booking_payload(rid, patient["id"], surgeon_id, start))
    assert denied.status_code == 400

    db = SessionLocal()
    try:
        room = db.get(OtRoom, rid)
        room.status = "AVAILABLE"
        db.commit()
    finally:
        db.close()
    ok = doctor.post("/api/ot/bookings", json=_booking_payload(rid, patient["id"], surgeon_id, start))
    assert ok.status_code == 201

    rec_denied = receptionist.post("/api/ot/bookings", json=_booking_payload(rid, patient["id"], surgeon_id, start + timedelta(hours=3)))
    assert rec_denied.status_code == 403

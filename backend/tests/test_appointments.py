from datetime import date, timedelta

TODAY = date.today()
NEXT_MONDAY = TODAY + timedelta(days=(7 - TODAY.weekday()) % 7 or 7)


def _book_first_slot(receptionist, patient_id: int, doctor_id: int, day=None):
    day = day or NEXT_MONDAY
    slots = receptionist.get(f"/api/doctors/{doctor_id}/slots", params={"date": day.isoformat()}).json()
    available = [s for s in slots["slots"] if s["available"]]
    assert available, f"no free slots on {day}"
    slot = available[0]
    res = receptionist.post(
        "/api/appointments",
        json={
            "patient_id": patient_id,
            "doctor_profile_id": doctor_id,
            "scheduled_date": day.isoformat(),
            "slot_start": slot["start"],
            "chief_complaint": "fever",
        },
    )
    return res, day


def test_seed_doctors_listed(receptionist):
    doctors = receptionist.get("/api/doctors")
    assert doctors.status_code == 200
    assert len(doctors.json()) >= 1
    assert all("doctor_name" in d for d in doctors.json())


def test_booking_flow_and_double_book_conflict(receptionist):
    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Kiran", "last_name": "Bedi", "phone": "+91-9000000010"},
    ).json()
    doctor = receptionist.get("/api/doctors").json()[0]

    booked, day = _book_first_slot(receptionist, patient["id"], doctor["id"])
    assert booked.status_code == 201, booked.text
    appt = booked.json()
    assert appt["status"] == "BOOKED"
    assert appt["token_number"] >= 1

    slots = receptionist.get(f"/api/doctors/{doctor['id']}/slots", params={"date": day.isoformat()}).json()
    taken = [s for s in slots["slots"] if s["start"] == appt["slot_start"].rsplit(".", 0)[0][:8]]
    assert taken and taken[0]["available"] is False

    conflict = receptionist.post(
        "/api/appointments",
        json={
            "patient_id": patient["id"],
            "doctor_profile_id": doctor["id"],
            "scheduled_date": day.isoformat(),
            "slot_start": appt["slot_start"][:8],
        },
    )
    assert conflict.status_code == 409


def test_status_transitions_enforced(receptionist):
    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Asha", "last_name": "Bhosle", "phone": "+91-9000000011"},
    ).json()
    doctor = receptionist.get("/api/doctors").json()[0]
    booked, _ = _book_first_slot(receptionist, patient["id"], doctor["id"])
    aid = booked.json()["id"]

    bad = receptionist.patch(f"/api/appointments/{aid}/status", json={"status": "COMPLETED"})
    assert bad.status_code == 400

    ok1 = receptionist.patch(f"/api/appointments/{aid}/status", json={"status": "CHECKED_IN"})
    assert ok1.status_code == 200 and ok1.json()["status"] == "CHECKED_IN"

    ok2 = receptionist.patch(f"/api/appointments/{aid}/status", json={"status": "IN_PROGRESS"})
    assert ok2.status_code == 200

    ok3 = receptionist.patch(f"/api/appointments/{aid}/status", json={"status": "COMPLETED"})
    assert ok3.status_code == 200 and ok3.json()["status"] == "COMPLETED"


def test_reschedule_moves_appointment(receptionist):
    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Ravi", "last_name": "Shastri", "phone": "+91-9000000012"},
    ).json()
    doctor = receptionist.get("/api/doctors").json()[0]
    booked, _ = _book_first_slot(receptionist, patient["id"], doctor["id"])
    original = booked.json()
    assert "id" in original, f"unexpected booking payload: {booked.text}"

    later_day = (NEXT_MONDAY + timedelta(days=7)).isoformat()
    res = receptionist.post(
        f"/api/appointments/{original['id']}/reschedule",
        json={"scheduled_date": later_day, "slot_start": original["slot_start"][:8]},
    )
    assert res.status_code == 200, res.text
    moved = res.json()
    assert moved["id"] != original["id"]
    assert moved["scheduled_date"] == later_day

    old = receptionist.get(f"/api/patients/{patient['id']}")
    listing = receptionist.get("/api/appointments", params={"patient_id": patient["id"]})
    statuses = {a["id"]: a["status"] for a in listing.json()}
    assert statuses[original["id"]] == "CANCELLED"


def test_outside_schedule_rejected(receptionist):
    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Off", "last_name": "Hours", "phone": "+91-9000000013"},
    ).json()
    doctor = receptionist.get("/api/doctors").json()[0]
    res = receptionist.post(
        "/api/appointments",
        json={
            "patient_id": patient["id"],
            "doctor_profile_id": doctor["id"],
            "scheduled_date": NEXT_MONDAY.isoformat(),
            "slot_start": "23:30",
        },
    )
    assert res.status_code == 400

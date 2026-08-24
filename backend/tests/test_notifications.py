def _latest(admin, event=None):
    params = {"limit": 50}
    if event:
        params["event"] = event
    return admin.get("/api/notifications", params=params).json()


def test_appointment_booking_creates_simulated_notification(receptionist):
    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Notif", "last_name": "Flow", "phone": "+91-9150000001"},
    ).json()
    doctor = receptionist.get("/api/doctors").json()[0]
    from datetime import date, timedelta

    day = date.today() + timedelta(days=(7 - date.today().weekday()) % 7 or 7)
    slots = receptionist.get(f"/api/doctors/{doctor['id']}/slots", params={"date": day.isoformat()}).json()
    slot = next(s for s in slots["slots"] if s["available"])

    booked = receptionist.post(
        "/api/appointments",
        json={
            "patient_id": patient["id"],
            "doctor_profile_id": doctor["id"],
            "scheduled_date": day.isoformat(),
            "slot_start": slot["start"],
        },
    )
    assert booked.status_code == 201

    notes = _latest(receptionist, "APPT_BOOKED")
    mine = [n for n in notes if n["recipient_phone"] == "+91-9150000001"]
    assert len(mine) >= 1
    assert mine[0]["status"] == "SIMULATED"
    assert "confirmed" in mine[0]["body"].lower()
    assert mine[0]["sent_at"] is not None


def test_disabled_plugin_skips_delivery(admin, receptionist):
    plugins = admin.get("/api/plugins").json()
    wa = next(p for p in plugins if p["slug"] == "whatsapp-channel")
    admin.post(f"/api/plugins/{wa['id']}/toggle")

    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Skip", "last_name": "Gate", "phone": "+91-9150000002"},
    ).json()
    doctor = receptionist.get("/api/doctors").json()[0]
    from datetime import date, timedelta

    day = date.today() + timedelta(days=(7 - date.today().weekday()) % 7 or 7)
    slots = receptionist.get(f"/api/doctors/{doctor['id']}/slots", params={"date": day.isoformat()}).json()
    slot = next(s for s in slots["slots"] if s["available"])
    receptionist.post(
        "/api/appointments",
        json={
            "patient_id": patient["id"],
            "doctor_profile_id": doctor["id"],
            "scheduled_date": day.isoformat(),
            "slot_start": slot["start"],
        },
    )

    skipped = [n for n in _latest(receptionist, "APPT_BOOKED") if n["status"] == "SKIPPED"]
    assert skipped and "disabled" in skipped[-1]["error"].lower()

    admin.post(f"/api/plugins/{wa['id']}/toggle")
    resent = admin.post(f"/api/notifications/{skipped[-1]['id']}/resend")
    assert resent.status_code == 200
    assert resent.json()["status"] == "SIMULATED"


def test_critical_lab_queues_clinician_alert(admin, labtech, doctor, nurse, receptionist):
    tests = admin.get("/api/lab/tests").json()
    glu = next(t for t in tests if t["code"] == "LABH-GLUF")
    patient = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Crit", "last_name": "Alert", "phone": "+91-9150000003"},
    ).json()

    order = doctor.post(
        "/api/lab/orders",
        json={"patient_id": patient["id"], "test_def_id": glu["id"], "priority": "STAT"},
    ).json()
    labtech.post(f"/api/lab/orders/{order['id']}/collect")
    result = labtech.post(f"/api/lab/orders/{order['id']}/result", json={"value_numeric": 38.0})
    assert result.json()["critical_alert"] is True

    criticals = [n for n in _latest(admin, "LAB_CRITICAL")]
    assert criticals and "CRITICAL" in criticals[0]["body"]

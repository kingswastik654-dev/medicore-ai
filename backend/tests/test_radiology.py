from datetime import datetime, timedelta, timezone


def _procedure(admin, code="RAD-CXR"):
    procs = admin.get("/api/rad/procedures").json()
    return next(p for p in procs if p["code"] == code)


def _order(doctor, patient_id, proc_id, priority="STAT", notes=None):
    res = doctor.post(
        "/api/rad/orders",
        json={
            "patient_id": patient_id,
            "procedure_def_id": proc_id,
            "priority": priority,
            "clinical_notes": notes,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def _patient(receptionist, first, last):
    return receptionist.post(
        "/api/patients?force=true", json={"first_name": first, "last_name": last, "phone": f"+91-9130{last}"[:13]}
    ).json()


def test_full_lifecycle_order_to_final_report(doctor, nurse, radtech, radiologist, receptionist, admin):
    cxr = _procedure(admin)
    patient = _patient(receptionist, "Radia", "Flow")

    order = _order(doctor, patient["id"], cxr["id"], priority="URGENT", notes="Persistent cough 3 weeks")
    assert order["status"] == "ORDERED"
    assert order["procedure_code"] == "RAD-CXR"
    assert order["modality"] == "XRAY"
    assert order["ai_priority"] is False

    prelim_too_early = radiologist.post(f"/api/rad/orders/{order['id']}/prelim", json={"report": "Normal study."})
    assert prelim_too_early.status_code == 400

    slot = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    scheduled = radtech.post(f"/api/rad/orders/{order['id']}/schedule", json={"scheduled_at": slot})
    assert scheduled.status_code == 200
    assert scheduled.json()["status"] == "SCHEDULED"

    acquired = radtech.post(f"/api/rad/orders/{order['id']}/acquire")
    assert acquired.status_code == 200
    assert acquired.json()["status"] == "ACQUIRED"

    denied_prelim = radtech.post(f"/api/rad/orders/{order['id']}/prelim", json={"report": "Tech cannot report."})
    assert denied_prelim.status_code == 403

    prelim = radiologist.post(
        f"/api/rad/orders/{order['id']}/prelim",
        json={"report": "Patchy right lower zone consolidation. Preliminary impression: pneumonia."},
    )
    assert prelim.status_code == 200
    body = prelim.json()
    assert body["status"] == "PRELIMINARY"
    assert body["reported_by"] == "Dr. Anil Rao"

    finalized = radiologist.post(f"/api/rad/orders/{order['id']}/finalize")
    assert finalized.status_code == 200
    final_body = finalized.json()
    assert final_body["status"] == "FINAL"
    assert "consolidation" in final_body["final_report"]
    assert final_body["final_report"] == body["prelim_report"]

    again = radiologist.post(f"/api/rad/orders/{order['id']}/finalize")
    assert again.status_code == 400


def test_state_machine_guards(admin, doctor, radtech, receptionist):
    ct = _procedure(admin, "RAD-CTBRAIN")
    patient = _patient(receptionist, "Guard", "Check")

    order = _order(doctor, patient["id"], ct["id"])
    oid = order["id"]

    acquire_first = radtech.post(f"/api/rad/orders/{oid}/acquire")
    assert acquire_first.status_code == 400

    slot = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    assert radtech.post(f"/api/rad/orders/{oid}/schedule", json={"scheduled_at": slot}).status_code == 200
    assert radtech.post(f"/api/rad/orders/{oid}/schedule", json={"scheduled_at": slot}).status_code == 400
    assert radtech.post(f"/api/rad/orders/{oid}/acquire").status_code == 200

    finalize_without_prelim = radtech.post(f"/api/rad/orders/{oid}/finalize")
    assert finalize_without_prelim.status_code in (403, 400)


def test_worklist_stat_first_and_modality_filter(admin, doctor, radtech, receptionist):
    mri = _procedure(admin, "RAD-MRIKNEE")
    cxr = _procedure(admin, "RAD-CXR")

    pa = _patient(receptionist, "Worklist", "Stat")
    pb = _patient(receptionist, "Worklist", "Routine")

    routine_cxr = _order(doctor, pb["id"], cxr["id"], priority="ROUTINE")
    stat_mri = _order(doctor, pa["id"], mri["id"], priority="STAT")

    worklist = radtech.get("/api/rad/orders", params={"status": "ORDERED"}).json()
    ids = [o["id"] for o in worklist]
    assert ids.index(stat_mri["id"]) < ids.index(routine_cxr["id"])

    mri_only = admin.get("/api/rad/orders", params={"modality": "MRI"}).json()
    assert all(o["modality"] == "MRI" for o in mri_only)
    assert stat_mri["id"] in [o["id"] for o in mri_only]
    assert routine_cxr["id"] not in [o["id"] for o in mri_only]


def test_ai_triage_flag_marks_priority_but_never_signs(admin, doctor, radtech, radiologist, receptionist):
    cxr = _procedure(admin)
    patient = _patient(receptionist, "AI", "Flagged")

    order = _order(doctor, patient["id"], cxr["id"], priority="ROUTINE")
    oid = order["id"]

    slot = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    radtech.post(f"/api/rad/orders/{oid}/schedule", json={"scheduled_at": slot})
    radtech.post(f"/api/rad/orders/{oid}/acquire")

    flagged = admin.post(
        f"/api/rad/orders/{oid}/ai-flag",
        json={"finding": "Imaging Triage AI: suspected rib fracture, left posterior 7th", "priority": True},
    )
    assert flagged.status_code == 200
    body = flagged.json()
    assert body["ai_priority"] is True
    assert "rib fracture" in body["ai_flag"]
    assert body["status"] == "ACQUIRED"

    signed = radiologist.post(
        f"/api/rad/orders/{oid}/prelim",
        json={"report": "No acute rib fracture on review; AI flag overruled by radiologist."},
    )
    assert signed.status_code == 200
    assert signed.json()["status"] == "PRELIMINARY"


def test_rbac_doctors_order_nurses_order_techs_operate(admin, nurse, doctor, receptionist):
    mammo = _procedure(admin, "RAD-MAMMO")
    patient = _patient(receptionist, "Perm", "Rad")

    nurse_ordered = nurse.post(
        "/api/rad/orders", json={"patient_id": patient["id"], "procedure_def_id": mammo["id"]}
    )
    assert nurse_ordered.status_code == 201

    denied_create = receptionist.post(
        "/api/rad/orders", json={"patient_id": patient["id"], "procedure_def_id": mammo["id"]}
    )
    assert denied_create.status_code == 403

    denied_schedule = doctor.post(
        f"/api/rad/orders/{nurse_ordered.json()['id']}/schedule",
        json={"scheduled_at": datetime.now(timezone.utc).isoformat()},
    )
    assert denied_schedule.status_code == 403

    denied_flag = doctor.post(
        f"/api/rad/orders/{nurse_ordered.json()['id']}/ai-flag",
        json={"finding": "Doctor should not set AI flags"},
    )
    assert denied_flag.status_code == 403


def test_procedure_catalog_crud_guardrails(admin, doctor):
    create = admin.post(
        "/api/rad/procedures",
        json={"code": "RAD-TESTXRAY", "name": "Test Extremity X-Ray", "modality": "XRAY", "body_part": "HAND", "tat_minutes": 30, "price": 250},
    )
    assert create.status_code == 201

    duplicate = admin.post(
        "/api/rad/procedures",
        json={"code": "RAD-TESTXRAY", "name": "Dup", "modality": "XRAY"},
    )
    assert duplicate.status_code == 409

    denied = doctor.post(
        "/api/rad/procedures",
        json={"code": "RAD-NOTALLOWED", "name": "Nope", "modality": "CT"},
    )
    assert denied.status_code == 403

    filtered = admin.get("/api/rad/procedures", params={"modality": "MAMMO"}).json()
    assert all(p["modality"] == "MAMMO" for p in filtered)

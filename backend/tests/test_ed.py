def _patient(receptionist, first, last, phone):
    return receptionist.post("/api/patients?force=true", json={"first_name": first, "last_name": last, "phone": phone}).json()

def test_ed_full_flow_register_triage_advance_disposition(doctor, nurse, receptionist, admin):
    patient = _patient(receptionist, "Ed", "Flow", "+91-9160000001")
    v = receptionist.post("/api/ed/visits", json={"patient_id": patient["id"], "arrival_mode": "WALK_IN", "chief_complaint": "Chest pain, 2 hrs"}).json()
    assert v["status"] == "REGISTERED"
    assert v["mlc_flag"] is False
    vid = v["id"]

    bad_advance = nurse.post(f"/api/ed/visits/{vid}/advance")
    assert bad_advance.status_code == 400

    triaged = nurse.post(f"/api/ed/visits/{vid}/triage", json={"esi_level": 2})
    assert triaged.status_code == 200
    assert triaged.json()["status"] == "TRIAGED"
    assert triaged.json()["esi_level"] == 2

    with_doc = nurse.post(f"/api/ed/visits/{vid}/advance")
    assert with_doc.status_code == 200
    assert with_doc.json()["status"] == "WITH_DOCTOR"

    diag = nurse.post(f"/api/ed/visits/{vid}/advance")
    assert diag.status_code == 200
    assert diag.json()["status"] == "DIAGNOSTICS"

    no_more = nurse.post(f"/api/ed/visits/{vid}/advance")
    assert no_more.status_code == 400

    disposed = doctor.post(f"/api/ed/visits/{vid}/disposition", json={"disposition": "ADMITTED"})
    assert disposed.status_code == 200
    assert disposed.json()["status"] == "DISPOSED"
    assert disposed.json()["disposition"] == "ADMITTED"

def test_ed_triage_gating_and_disposition_guard(doctor, nurse, receptionist):
    p = _patient(receptionist, "Ed", "Gate", "+91-9160000002")
    v = receptionist.post("/api/ed/visits", json={"patient_id": p["id"]}).json()
    denied_disp = doctor.post(f"/api/ed/visits/{v['id']}/disposition", json={"disposition": "DISCHARGED"})
    assert denied_disp.status_code == 400

    denied_triage = receptionist.post(f"/api/ed/visits/{v['id']}/triage", json={"esi_level": 3})
    assert denied_triage.status_code == 403

    assert nurse.post(f"/api/ed/visits/{v['id']}/triage", json={"esi_level": 4}).status_code == 200
    assert doctor.post(f"/api/ed/visits/{v['id']}/disposition", json={"disposition": "DISCHARGED"}).status_code == 200
    again = doctor.post(f"/api/ed/visits/{v['id']}/disposition", json={"disposition": "DISCHARGED"})
    assert again.status_code == 400

def test_ed_mlc_flag_restricted_and_board(doctor, nurse, receptionist, admin):
    p1 = _patient(receptionist, "Ed", "MlcOk", "+91-9160000003")
    v1 = receptionist.post("/api/ed/visits", json={"patient_id": p1["id"], "chief_complaint": "RTA, head injury"}).json()
    nurse.post(f"/api/ed/visits/{v1['id']}/triage", json={"esi_level": 1})

    denied = nurse.post(f"/api/ed/visits/{v1['id']}/mlc", json={"mlc_flag": True})
    assert denied.status_code == 403

    ok = doctor.post(f"/api/ed/visits/{v1['id']}/mlc", json={"mlc_flag": True})
    assert ok.status_code == 200
    assert ok.json()["mlc_flag"] is True

    assert admin.post(f"/api/ed/visits/{v1['id']}/mlc", json={"mlc_flag": False}).status_code == 200

    p2 = _patient(receptionist, "Ed", "Board2", "+91-9160000004")
    v2 = receptionist.post("/api/ed/visits", json={"patient_id": p2["id"]}).json()
    nurse.post(f"/api/ed/visits/{v2['id']}/triage", json={"esi_level": 5})

    board = doctor.get("/api/ed/board").json()
    assert "columns" in board and "stats" in board
    assert board["stats"]["active"] >= 2
    assert board["stats"]["critical_open"] >= 1

    visits = doctor.get("/api/ed/visits").json()
    assert visits[0]["esi_level"] in (1, 2)

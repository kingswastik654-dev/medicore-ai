PATIENT_A = {
    "first_name": "Anita",
    "last_name": "Sharma",
    "dob": "1990-04-15",
    "gender": "FEMALE",
    "phone": "+91-9000000001",
}


def test_register_patient_returns_mrn(receptionist):
    res = receptionist.post("/api/patients", json=PATIENT_A)
    assert res.status_code == 201
    body = res.json()
    assert body["created"] is True
    assert body["mrn"].startswith("MRN-")
    assert body["full_name"] == "Anita Sharma"


def test_duplicate_detection_blocks_and_force_creates(receptionist):
    dup = dict(PATIENT_A)
    dup["phone"] = "+91-9000000002"
    first = receptionist.post("/api/patients?force=true", json=dup).json()

    again = receptionist.post("/api/patients", json=dict(PATIENT_A))
    assert again.status_code == 201
    payload = again.json()
    assert payload["created"] is False
    assert any(m["patient_id"] == first["id"] for m in payload["potential_duplicates"])

    forced = receptionist.post("/api/patients?force=true", json=dict(PATIENT_A))
    assert forced.status_code == 201
    assert forced.json()["created"] is True


def test_check_duplicates_endpoint(receptionist):
    res = receptionist.post("/api/patients/check-duplicates", json=PATIENT_A)
    assert res.status_code == 200
    matches = res.json()["potential_duplicates"]
    assert len(matches) >= 1
    assert matches[0]["score"] >= 60


def test_search_by_phone(receptionist):
    listed = receptionist.get("/api/patients", params={"q": "+91-9000000001"})
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) >= 1


def test_get_patient_audited(admin, receptionist):
    created = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Vikram", "last_name": "Rao", "phone": "+91-9000000003"},
    ).json()
    pid = created["id"]

    got = admin.get(f"/api/patients/{pid}")
    assert got.status_code == 200

    audits = admin.get("/api/audits", params={"patient_id": pid})
    actions = [a["action"] for a in audits.json()["items"]]
    assert "CREATE" in actions
    assert "READ" in actions


def test_merge_duplicates_moves_references(receptionist):
    p1 = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Mohan", "last_name": "Lal", "phone": "+91-9000000004"},
    ).json()
    p2 = receptionist.post(
        "/api/patients?force=true",
        json={"first_name": "Mohan", "last_name": "Lal", "phone": "+91-9000000004", "dob": "1975-01-01"},
    ).json()

    merged = receptionist.post(f"/api/patients/{p2['id']}/merge", json={"survivor_id": p1["id"]})
    assert merged.status_code == 200

    gone = receptionist.get(f"/api/patients/{p2['id']}")
    assert gone.status_code == 404

    survivor = receptionist.get(f"/api/patients/{p1['id']}")
    assert survivor.status_code == 200


def test_cashier_cannot_register_patient(cashier):
    res = cashier.post("/api/patients", json={"first_name": "No", "last_name": "Access"})
    assert res.status_code == 403

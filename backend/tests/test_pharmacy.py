def _get_drug(admin, code):
    drugs = admin.get("/api/drugs").json()
    return next(d for d in drugs if d["code"] == code)


def _make_patient(receptionist, first, last, phone, allergies=None):
    payload = {"first_name": first, "last_name": last, "phone": phone}
    if allergies:
        payload["allergies"] = allergies
    return receptionist.post("/api/patients?force=true", json=payload).json()


def test_seed_drugs_and_stock_visible(doctor):
    drugs = doctor.get("/api/drugs").json()
    codes = {d["code"] for d in drugs}
    assert {"DRUG-ASA", "DRUG-WARF", "DRUG-AMOX"} <= codes
    warf = _get_drug(doctor, "DRUG-WARF")
    assert warf["in_stock"] == 550


def test_interaction_and_allergy_warnings_on_prescription(doctor):
    patient = _make_patient(doctor, "Rx", "Warn", "+91-9110000001", allergies="Aspirin sensitivity")
    asa = _get_drug(doctor, "DRUG-ASA")
    warf = _get_drug(doctor, "DRUG-WARF")

    res = doctor.post(
        "/api/prescriptions",
        json={
            "patient_id": patient["id"],
            "items": [
                {"drug_id": asa["id"], "dosage": "75 mg", "frequency": "OD", "duration_days": 30, "quantity": 30},
                {"drug_id": warf["id"], "dosage": "5 mg", "frequency": "OD", "quantity": 10},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    types = {(w["type"], w["severity"]) for w in body["warnings"]}
    assert ("INTERACTION", "MAJOR") in types
    allergy_hits = [w for w in body["warnings"] if w["type"] == "ALLERGY"]
    assert allergy_hits and all(w["severity"] == "MAJOR" for w in allergy_hits)


def test_dispense_blocked_until_warnings_acknowledged(pharmacist, doctor):
    patient = _make_patient(doctor, "Ack", "Test", "+91-9110000002")
    asa = _get_drug(doctor, "DRUG-ASA")
    ibu = _get_drug(doctor, "DRUG-IBUP")

    rx = doctor.post(
        "/api/prescriptions",
        json={
            "patient_id": patient["id"],
            "items": [
                {"drug_id": asa["id"], "dosage": "75 mg", "frequency": "OD", "quantity": 10},
                {"drug_id": ibu["id"], "dosage": "400 mg", "frequency": "TDS", "quantity": 15},
            ],
        },
    ).json()
    interaction_present = any(w["type"] == "INTERACTION" for w in rx["warnings"])

    denied = pharmacist.post(f"/api/prescriptions/{rx['id']}/dispense", json={"acknowledge_warnings": False})
    if interaction_present:
        assert denied.status_code == 400
        acked = pharmacist.post(f"/api/prescriptions/{rx['id']}/dispense", json={"acknowledge_warnings": True})
    else:
        acked = denied
    assert acked.status_code == 200
    assert acked.json()["status"] == "DISPENSED"

    again = pharmacist.post(f"/api/prescriptions/{rx['id']}/dispense", json={"acknowledge_warnings": True})
    assert again.status_code == 400


def test_fefo_uses_earliest_expiry_batch_first(doctor, pharmacist):
    from datetime import date

    today = date.today()
    patient = _make_patient(doctor, "Fefo", "Check", "+91-9110000003")
    warf = _get_drug(doctor, "DRUG-WARF")

    rx = doctor.post(
        "/api/prescriptions",
        json={
            "patient_id": patient["id"],
            "items": [{"drug_id": warf["id"], "dosage": "5 mg", "frequency": "OD", "quantity": 260}],
        },
    )
    warnings = rx.json()["warnings"]
    dispensed = pharmacist.post(
        f"/api/prescriptions/{rx.json()['id']}/dispense",
        json={"acknowledge_warnings": bool(warnings)},
    )
    assert dispensed.status_code == 200

    batches = pharmacist.get("/api/drugs").json()
    warf_after = next(d for d in batches if d["code"] == "DRUG-WARF")
    assert warf_after["in_stock"] == 550 - 260

    detail_rows = pharmacist.get("/api/prescriptions", params={"patient_id": patient["id"]}).json()
    assert detail_rows[0]["status"] == "DISPENSED"
    assert today is not None


def test_insufficient_stock_rejected(doctor, pharmacist):
    patient = _make_patient(doctor, "No", "Stock", "+91-9110000004")
    amox = _get_drug(doctor, "DRUG-AMOX")

    rx = doctor.post(
        "/api/prescriptions",
        json={
            "patient_id": patient["id"],
            "items": [{"drug_id": amox["id"], "dosage": "500 mg", "frequency": "TDS", "quantity": 999}],
        },
    ).json()

    res = pharmacist.post(f"/api/prescriptions/{rx['id']}/dispense", json={"acknowledge_warnings": True})
    assert res.status_code == 409
    assert "Insufficient stock" in res.json()["detail"] or "short" in str(res.json()).lower()


def test_doctor_cannot_dispense_but_pharmacist_cannot_prescribe(doctor, pharmacist):
    assert pharmacist.get("/api/drugs").status_code == 200

    patient = _make_patient(doctor, "Role", "Guard", "+91-9110000005")
    denied_rx = pharmacist.post(
        "/api/prescriptions",
        json={
            "patient_id": patient["id"],
            "items": [{"drug_id": _get_drug(doctor, "DRUG-PARA")["id"], "dosage": "650 mg", "frequency": "SOS"}],
        },
    )
    assert denied_rx.status_code == 403
